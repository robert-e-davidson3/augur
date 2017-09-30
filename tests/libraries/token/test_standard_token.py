#!/usr/bin/env python

from ethereum.tools import tester
from ethereum.tools.tester import TransactionFailed
from pytest import raises


def test_eternal_approval_magic(contractsFixture):
    # We'll upload the StandardTokenHelper for use in testing the StandardToken base class here. We just need the faucet added in that subclass
    standardToken = contractsFixture.uploadAndAddToController("solidity_test_helpers/StandardTokenHelper.sol")
    assert standardToken.totalSupply() == 0

    # We get some tokens for tester 0
    assert standardToken.faucet(100)
    assert standardToken.totalSupply() == 100
    assert standardToken.balanceOf(tester.a0) == 100

    # Tester 1 tries to send tokens from tester 0 to himself and fails
    with raises(TransactionFailed):
        standardToken.transferFrom(tester.a0, tester.a1, 1)

    # Tester 0 does a small approval amount for Tester 1 who then withdraws some, which changes their allowance accordingly
    assert standardToken.approve(tester.a1, 2)
    assert standardToken.allowance(tester.a0, tester.a1) == 2
    assert standardToken.transferFrom(tester.a0, tester.a1, 1, sender=tester.k1)
    assert standardToken.allowance(tester.a0, tester.a1) == 1
    assert standardToken.balanceOf(tester.a0) == 99
    assert standardToken.balanceOf(tester.a1) == 1

    # Tester 0 approves Tester 1 for the magic eternal approval amount
    assert standardToken.approve(tester.a1, 2 ** 256 - 1)
    assert standardToken.allowance(tester.a0, tester.a1) == 2 ** 256 - 1

    # Now when Tester 1 does a transfer the allowance does not change
    assert standardToken.transferFrom(tester.a0, tester.a1, 95, sender=tester.k1)
    assert standardToken.allowance(tester.a0, tester.a1) == 2 ** 256 - 1
    assert standardToken.balanceOf(tester.a0) == 4
    assert standardToken.balanceOf(tester.a1) == 96
    
def test_create_negative_balance(contractsFixture):
    standardToken = contractsFixture.uploadAndAddToController("solidity_test_helpers/StandardTokenHelper.sol")
    assert standardToken.totalSupply() == 0
    # We get some tokens for tester 0
    assert standardToken.faucet(100)
    assert standardToken.balanceOf(tester.a0) == 100
    # Tester 1 tries to send tokens from tester 0 to himself and fails
    with raises(TransactionFailed):
        standardToken.transferFrom(tester.a0, tester.a1, 101)

def test_transfer_then_create_negative_balance(contractsFixture):
    standardToken = contractsFixture.uploadAndAddToController("solidity_test_helpers/StandardTokenHelper.sol")
    assert standardToken.totalSupply() == 0
    # We get some tokens for tester 0
    assert standardToken.faucet(10)
    assert standardToken.balanceOf(tester.a0) == 10
    # approve and transfer 10 to other tester
    assert standardToken.approve(tester.a1, 10)
    assert standardToken.allowance(tester.a0, tester.a1) == 10
    assert standardToken.transferFrom(tester.a0, tester.a1, 10, sender=tester.k1)
    assert standardToken.balanceOf(tester.a1) == 10
    # approve and allow transfer of more tokens than tester has
    assert standardToken.approve(tester.a1, 11)
    # try to transfer more than tester has  
    with raises(TransactionFailed):
        standardToken.transferFrom(tester.a0, tester.a1, 11)

def test_approve_allow_transfer_more_than_allow(contractsFixture):
    standardToken = contractsFixture.uploadAndAddToController("solidity_test_helpers/StandardTokenHelper.sol")
    assert standardToken.totalSupply() == 0
    # We get some tokens for tester 0
    assert standardToken.faucet(100000)
    assert standardToken.balanceOf(tester.a0) == 100000
    # approve and transfer more than in supply
    assert standardToken.approve(tester.a1, 100)
    assert standardToken.allowance(tester.a0, tester.a1) == 100
    assert standardToken.balanceOf(tester.a1) == 0
    with raises(TransactionFailed):
        standardToken.transferFrom(tester.a0, tester.a1, 101, sender=tester.k1)

def test_approve_allow_transfer_more_than_allow(contractsFixture):
    standardToken = contractsFixture.uploadAndAddToController("solidity_test_helpers/StandardTokenHelper.sol")
    assert standardToken.totalSupply() == 0
    # We get some tokens for tester 0
    assert standardToken.faucet(100000)
    assert standardToken.balanceOf(tester.a0) == 100000
    # approve and transfer more than in supply
    assert standardToken.approve(tester.a1, 100)
    assert standardToken.allowance(tester.a0, tester.a1) == 100
    assert standardToken.balanceOf(tester.a1) == 0
    with raises(TransactionFailed):
        standardToken.transferFrom(tester.a0, tester.a1, 101, sender=tester.k1)

def test_ping_pong_transfers(contractsFixture):
    standardToken = contractsFixture.uploadAndAddToController("solidity_test_helpers/StandardTokenHelper.sol")
    assert standardToken.totalSupply() == 0
    # We get some tokens for tester 0
    assert standardToken.faucet(200)
    assert standardToken.balanceOf(tester.a0) == 200
    assert standardToken.approve(tester.a1, 100)
    assert standardToken.allowance(tester.a0, tester.a1) == 100
    assert standardToken.transferFrom(tester.a0, tester.a1, 100, sender=tester.k1)
    assert standardToken.balanceOf(tester.a0) == 100
    assert standardToken.balanceOf(tester.a1) == 100
    assert standardToken.allowance(tester.a0, tester.a1) == 0
    # transfer back and forth
    for x in range(0, 10):
        assert standardToken.balanceOf(tester.a0) == 100
        assert standardToken.balanceOf(tester.a1) == 100
        assert standardToken.approve(tester.a1, 10)
        assert standardToken.allowance(tester.a0, tester.a1) == 10
        assert standardToken.transferFrom(tester.a0, tester.a1, 10, sender=tester.k1)
        assert standardToken.balanceOf(tester.a0) == 90
        assert standardToken.balanceOf(tester.a1) == 110        
        assert standardToken.approve(tester.a0, 10, sender=tester.k1)
        assert standardToken.allowance(tester.a1, tester.a0) == 10
        assert standardToken.transferFrom(tester.a1, tester.a0, 10, sender=tester.k0)
        assert standardToken.balanceOf(tester.a0) == 100
        assert standardToken.balanceOf(tester.a1) == 100

    assert standardToken.balanceOf(tester.a0) == 100
    assert standardToken.balanceOf(tester.a1) == 100
