# lima-smart-contracts

This is the LimaLendingOptimizer contracts repo.
It is build on top of 3 contracts LimaToken, LimaTokenHelper, and LimaSwap

- LimaToken is the main contract that uses the other two.
- LimaTokenHelper is to store LimaToken data and has helpful functions used by LimaToken.
- LimaSwap allows to swap stable token.

## Buidler + Open zeppelin

Used this tutorial to set them up:
[https://forum.openzeppelin.com/t/openzeppelin-buidler-upgrades/3580](https://forum.openzeppelin.com/t/openzeppelin-buidler-upgrades/3580)

## Running local ganache + tests

Copy `.env_example => .env` and fill in variables.

Run local the ganache blockchain that is connected to a fork from the Ethereum mainnet

- npm run start
- npm run test

## deploy smart contracts

-- npm run deploy

## Contracts

### LimaToken

#### Rebalance

Is called every 24 hours:

1. rebalance() swaps underlying token to new best lending token. Also swaps governance token to best lending token and buys LINK if needed.

#### Create

Called by a user to create/mint LimaToken. Needs to approve the investment token and amount to create LimaToken of the same value (sub fees).

#### Redeem

Called by a user to redeem/burn LimaToken and pays out its value in payout token (sub fees).

### LimaTokenHelper

Has all the setter and getter functions to store data (LimaTokenStorage.sol). HAs also helper functions (LimaTokenHelper.sol)
Notable functions:

#### getPerformanceFee

Return the performance over the last time interval

### LimaSwap

#### swap()

swap from token A to token B for sender. Receiver of funds needs to be passed. Sender needs to approve LimaSwap to use her tokens

#### unwrap()

swap interesting bearing token to its underlying from either AAve or Compound

#### getGovernanceToken()

gives underling governance token of product

#### getExpectedReturn()

used for getting aproximate return amount from exchanging stable coins or interest bearing tokens to usdt usdc or dai
