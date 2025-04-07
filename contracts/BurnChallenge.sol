// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface ILiquidityPool {
    function buyTokens() external payable;
}

interface ITokenFactory {
    function getLiquidityPool(address token) external view returns (address);
}

contract BurnChallenge is Ownable(msg.sender), ReentrancyGuard {
    uint256 public immutable CHALLENGE_DURATION;
    uint256 public immutable VOTES_RESET_PERIOD;
    uint256 public immutable MAX_DAILY_VOTES;
    ITokenFactory public immutable tokenFactory;

    struct Challenge {
        uint256 startTime;
        uint256 endTime;
        address winningToken;
        uint256 vaultAmount;
        bool executed;
        address[] votedTokens;
        uint256 totalVotes;
    }

    uint256 public vaultBalance;
    uint256 public currentChallengeId;

    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => mapping(address => uint256)) public challengeTokenVotes;
    mapping(uint256 => mapping(address => bool)) public challengeHasVoted;

    event FeesReceived(uint256 amount);

    constructor(address _tokenFactory) {
        tokenFactory = ITokenFactory(_tokenFactory);

        CHALLENGE_DURATION = 1 hours;
        VOTES_RESET_PERIOD = 1 days;
        MAX_DAILY_VOTES = 5;

        _startNewChallenge();
    }

    function forceCompleteChallenge() external nonReentrant onlyOwner {
        uint256 challengeId = currentChallengeId;
        Challenge storage challenge = challenges[challengeId];

        challenge.endTime = block.timestamp;
    }

    function vote(address token) external nonReentrant {
        uint256 challengeId = currentChallengeId;
        Challenge storage challenge = challenges[challengeId];

        require(block.timestamp < challenge.endTime, "Challenge ended");
        require(!challengeHasVoted[challengeId][msg.sender], "Already voted");

        if (challengeTokenVotes[challengeId][token] == 0) {
            challenge.votedTokens.push(token);
        }

        challengeTokenVotes[challengeId][token]++;
        challengeHasVoted[challengeId][msg.sender] = true;
        challenge.totalVotes++;
    }

    function completeChallenge() external nonReentrant {
        uint256 challengeId = currentChallengeId;
        Challenge storage challenge = challenges[challengeId];

        require(block.timestamp >= challenge.endTime, "Not ended yet");
        require(!challenge.executed, "Already executed");

        if (challenge.totalVotes == 0) {
            challenge.winningToken = address(0);
            challenge.vaultAmount = vaultBalance;
            challenge.executed = true;

            _startNewChallenge();
            return;
        }

        address winningToken = address(0);
        uint256 highestVotes = 0;

        for (uint256 i = 0; i < challenge.votedTokens.length; i++) {
            address token = challenge.votedTokens[i];
            uint256 votes = challengeTokenVotes[challengeId][token];

            if (votes > highestVotes) {
                highestVotes = votes;
                winningToken = token;
            }
        }

        challenge.winningToken = winningToken;
        challenge.vaultAmount = vaultBalance;
        challenge.executed = true;

        uint256 burnAmount = vaultBalance;

        if (burnAmount > 0) {
            vaultBalance = 0;

            address liquidityPool = tokenFactory.getLiquidityPool(winningToken);
            require(liquidityPool != address(0), "LP not found");

            (bool success, ) = liquidityPool.call{value: burnAmount}(
                abi.encodeWithSignature("buyTokens()")
            );
            require(success, "Token burn failed");
        }

        _startNewChallenge();
    }

    function getChallengeInfo(uint256 challengeId)
        external
        view
        returns (
            uint256 startTime,
            uint256 endTime,
            address winningToken,
            uint256 vaultAmount,
            bool executed,
            uint256 timeRemaining,
            uint256 totalVotes
        )
    {
        Challenge storage challenge = challenges[challengeId];

        uint256 remaining = 0;
        if (!challenge.executed && block.timestamp < challenge.endTime) {
            remaining = challenge.endTime - block.timestamp;
        }

        return (
            challenge.startTime,
            challenge.endTime,
            challenge.winningToken,
            challenge.vaultAmount,
            challenge.executed,
            remaining,
            challenge.totalVotes
        );
    }

    function getChallengeTokens(uint256 challengeId)
        external
        view
        returns (address[] memory tokens, uint256[] memory votes)
    {
        Challenge storage challenge = challenges[challengeId];

        uint256 count = challenge.votedTokens.length;

        tokens = new address[](count);
        votes = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            tokens[i] = challenge.votedTokens[i];
            votes[i] = challengeTokenVotes[challengeId][tokens[i]];
        }

        if (count > 1) {
            for (uint256 i = 0; i < count - 1; i++) {
                for (uint256 j = 0; j < count - i - 1; j++) {
                    if (votes[j] < votes[j + 1]) {
                        uint256 tempVote = votes[j];
                        votes[j] = votes[j + 1];
                        votes[j + 1] = tempVote;

                        address tempToken = tokens[j];
                        tokens[j] = tokens[j + 1];
                        tokens[j + 1] = tempToken;
                    }
                }
            }
        }

        return (tokens, votes);
    }

    function _startNewChallenge() internal {
        currentChallengeId++;

        Challenge storage newChallenge = challenges[currentChallengeId];
        newChallenge.startTime = block.timestamp;
        newChallenge.endTime = block.timestamp + CHALLENGE_DURATION;
        newChallenge.totalVotes = 0;
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 amount = vaultBalance;
        vaultBalance = 0;
        (bool success, ) = owner().call{value: amount}("");
        require(success, "Transfer failed");
    }

    receive() external payable {
        vaultBalance += msg.value;
        emit FeesReceived(msg.value);
    }
}
