// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ChapChapPaymentRegistry
/// @author ChapChap
/// @notice A lightweight onchain registry for payment intents created by ChapChap.
/// @dev This contract does not move funds. It only stores intent metadata onchain.
contract ChapChapPaymentRegistry {
    struct PaymentIntent {
        uint256 id;
        address creator;
        address recipient;
        uint256 amount;
        string tokenSymbol;
        string note;
        uint256 scheduledFor;
        uint256 createdAt;
    }

    uint256 private _paymentIntentCounter;

    mapping(uint256 => PaymentIntent) private _paymentIntents;
    mapping(address => uint256[]) private _paymentIntentIdsByCreator;

    event PaymentIntentCreated(
        uint256 id,
        address indexed creator,
        address indexed recipient,
        uint256 amount,
        string tokenSymbol,
        uint256 scheduledFor
    );

    /// @notice Stores a new payment intent onchain.
    /// @param recipient The intended recipient wallet address.
    /// @param amount The intended transfer amount in smallest-app-defined unit.
    /// @param tokenSymbol The asset symbol, for example "XTZ" or "USDC".
    /// @param note A short optional note describing the payment.
    /// @param scheduledFor Unix timestamp for scheduled execution, or 0 for immediate intent.
    /// @return newId The newly created payment intent id.
    function createPaymentIntent(
        address recipient,
        uint256 amount,
        string memory tokenSymbol,
        string memory note,
        uint256 scheduledFor
    ) external returns (uint256 newId) {
        require(recipient != address(0), "Recipient is required");
        require(amount > 0, "Amount must be greater than zero");
        require(bytes(tokenSymbol).length > 0, "Token symbol is required");

        _paymentIntentCounter += 1;
        newId = _paymentIntentCounter;

        PaymentIntent memory intent = PaymentIntent({
            id: newId,
            creator: msg.sender,
            recipient: recipient,
            amount: amount,
            tokenSymbol: tokenSymbol,
            note: note,
            scheduledFor: scheduledFor,
            createdAt: block.timestamp
        });

        _paymentIntents[newId] = intent;
        _paymentIntentIdsByCreator[msg.sender].push(newId);

        emit PaymentIntentCreated(
            newId,
            msg.sender,
            recipient,
            amount,
            tokenSymbol,
            scheduledFor
        );
    }

    /// @notice Returns a stored payment intent by id.
    /// @param id The payment intent id.
    /// @return The stored payment intent struct.
    function getPaymentIntent(uint256 id) external view returns (PaymentIntent memory) {
        require(id > 0 && id <= _paymentIntentCounter, "Payment intent does not exist");
        return _paymentIntents[id];
    }

    /// @notice Returns all payment intent ids created by the caller.
    /// @return The array of payment intent ids created by msg.sender.
    function getMyPaymentIntentIds() external view returns (uint256[] memory) {
        return _paymentIntentIdsByCreator[msg.sender];
    }

    /// @notice Returns the total number of created payment intents.
    /// @return The current payment intent count.
    function totalPaymentIntents() external view returns (uint256) {
        return _paymentIntentCounter;
    }
}
