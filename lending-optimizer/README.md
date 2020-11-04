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

Is called in 3 parts every 24 hours:

1. initRebalance() starts an oracle call that checks for the best new lending token.
2. Oracle returns data to receiveOracleData() and stores it on chain.
3. rebalance() swaps underlying token to new best lending token. Also swaps governance token to best lending token and buys LINK if needed.

#### Create

Called by a user to create/mint LimaToken. Needs to approve the investment token and amount to create LimaToken of the same value (sub fees).

#### Redeem

Called by a user to redeem/burn LimaToken and pays out its value in payout token (sub fees).

### LimaTokenHelper

Has all the setter and getter functions to store data (LimaTokenStorage.sol). HAs also helper functions (LimaTokenHelper.sol)
Notable functions:

#### decodeOracleData(bytes32 data)

It extracts data from oracle payload.
To be more precise, it's extracting 4 values:
address, which takes last 160 bits of oracle bytes32 data ( it extracts it by mapping bytes32 to uint160, which allows to get rid of other 96 bits)
three numbers, where each is extracted by doing following:

1. Shift bits to the right (there is no bit shift opcode in the evm though, so this operation might be more expensive than I thought), so given (one of the three) number has it bits on last (least significant) 32 bits of uint256.
2. Now I get rid of more significant bits (all on the other 224 bits) by casting to uint32.
3. Once I have uint32, I have to now split this numbers into two values. One uint8 and one uint24. This uint24 represents the original number, but divided by 2^<uint8_value>, so in other words, original number, but shifted to the right by number of bits, where this number is stored in this uint8 value.

#### getPayback

Return the amount to mint in LimaToken as payback for user function call

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
