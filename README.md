# SomniaMeme Smart Contracts

This project contains a collection of smart contracts for the SomniaMeme platform, built using Hardhat and Solidity. The contracts implement various DeFi functionalities including token management, liquidity pools, and challenge mechanisms.

## Project Structure

- `contracts/` - Contains all Solidity smart contracts
  - `BurnChallenge.sol` - Implements a token burning challenge mechanism
  - `CustomToken.sol` - Base ERC20 token implementation
  - `LiquidityPool.sol` - Manages liquidity pool operations
  - `TokenFactory.sol` - Factory contract for creating new tokens

## Prerequisites

- Node.js (v16 or later)
- npm or yarn package manager

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Development

The project uses Hardhat for development, testing, and deployment. Available commands:

```bash
# Run tests
npx hardhat test

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test

# Start local Hardhat network
npx hardhat node

# Compile contracts
npx hardhat compile
```

## Dependencies

- Hardhat v2.22.19
- OpenZeppelin Contracts v5.2.0
- Ethers.js v6.13.5

## License

This project is licensed under the MIT License - see the LICENSE file for details.
