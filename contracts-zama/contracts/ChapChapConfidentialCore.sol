// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, ebool, euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ChapChapConfidentialCore
/// @notice Minimal Sepolia MVP contract for confidential internal balances, transfers, and savings.
/// @dev Deposits are public ETH transfers; internal balances and savings buckets are encrypted.
contract ChapChapConfidentialCore is ZamaEthereumConfig {
    mapping(address account => euint64 balance) private _balances;
    mapping(address account => euint64 savings) private _savings;
    mapping(address account => uint256 amountWei) public publicBalanceMirror;
    mapping(address account => uint256 amountWei) public publicSavingsMirror;

    struct Agreement {
        address creator;
        address recipient;
        uint256 deadline;
        bytes32 metadataHash;
        uint8 status;
        uint256 amountWei;
    }

    uint256 public totalPublicDepositsWei;
    uint256 public nextAgreementId;

    mapping(uint256 agreementId => Agreement agreement) public agreements;

    event Deposit(address indexed account, uint256 publicAmountWei, bytes32 encryptedBalanceRef);
    event ConfidentialTransfer(
        address indexed sender,
        address indexed recipient,
        bytes32 encryptedAmountRef
    );
    event ConfidentialSavings(address indexed account, bytes32 encryptedAmountRef);
    event Withdrawal(address indexed account, uint256 publicAmountWei, bytes32 encryptedBalanceRef);
    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed creator,
        address indexed recipient,
        uint256 amountWei,
        uint256 deadline,
        bytes32 metadataHash
    );
    event AgreementSettled(
        uint256 indexed agreementId,
        address indexed creator,
        address indexed recipient,
        bool releasedFunds,
        uint8 status
    );

    error DepositValueTooLarge();
    error WithdrawalValueTooLarge();
    error ZeroDeposit();
    error InvalidRecipient();
    error InvalidAmount();
    error InsufficientContractLiquidity();
    error AgreementNotFound();
    error AgreementAlreadySettled();
    error NotAgreementCreator();
    error InvalidDeadline();
    error TransferFailed();

    /// @notice Deposit public ETH into the contract and credit the sender's encrypted internal balance.
    function deposit() external payable {
        if (msg.value == 0) {
            revert ZeroDeposit();
        }
        if (msg.value > type(uint64).max) {
            revert DepositValueTooLarge();
        }

        euint64 encryptedDeposit = FHE.asEuint64(uint64(msg.value));
        _balances[msg.sender] = FHE.add(_balances[msg.sender], encryptedDeposit);
        publicBalanceMirror[msg.sender] += msg.value;

        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);

        totalPublicDepositsWei += msg.value;

        emit Deposit(
            msg.sender,
            msg.value,
            keccak256(abi.encodePacked("deposit", msg.sender, block.number, msg.value))
        );
    }

    /// @notice Withdraw a known public ETH amount from the caller's encrypted balance.
    /// @dev For MVP, the caller specifies a public amount and the contract debits the same encrypted amount.
    function withdraw(uint64 publicAmountWei) external {
        if (publicAmountWei == 0) {
            revert InvalidAmount();
        }
        if (publicBalanceMirror[msg.sender] < publicAmountWei) {
            revert InvalidAmount();
        }
        if (address(this).balance < publicAmountWei) {
            revert InsufficientContractLiquidity();
        }

        euint64 requestedAmount = FHE.asEuint64(publicAmountWei);
        ebool hasEnoughBalance = FHE.le(requestedAmount, _balances[msg.sender]);
        euint64 withdrawalValue = FHE.select(
            hasEnoughBalance,
            requestedAmount,
            FHE.asEuint64(0)
        );

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], withdrawalValue);

        FHE.allowThis(_balances[msg.sender]);
        FHE.allowThis(withdrawalValue);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allow(withdrawalValue, msg.sender);
        publicBalanceMirror[msg.sender] -= publicAmountWei;

        (bool success, ) = payable(msg.sender).call{ value: publicAmountWei }("");
        if (!success) {
            revert TransferFailed();
        }

        emit Withdrawal(
            msg.sender,
            publicAmountWei,
            keccak256(abi.encodePacked("withdraw", msg.sender, block.number, publicAmountWei))
        );
    }

    /// @notice Transfer a confidential amount from the caller's encrypted balance to a recipient.
    /// @dev If the requested amount exceeds the sender balance, the actual transferred amount becomes encrypted zero.
    function transferConfidential(
        address recipient,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        uint64 publicAmountWei
    ) external returns (euint64) {
        if (recipient == address(0)) {
            revert InvalidRecipient();
        }
        if (publicAmountWei == 0) {
            revert InvalidAmount();
        }
        if (publicBalanceMirror[msg.sender] < publicAmountWei) {
            revert InvalidAmount();
        }

        euint64 requestedAmount = FHE.fromExternal(encryptedAmount, inputProof);
        ebool hasEnoughBalance = FHE.le(requestedAmount, _balances[msg.sender]);
        euint64 transferValue = FHE.select(
            hasEnoughBalance,
            requestedAmount,
            FHE.asEuint64(0)
        );

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], transferValue);
        _balances[recipient] = FHE.add(_balances[recipient], transferValue);
        publicBalanceMirror[msg.sender] -= publicAmountWei;
        publicBalanceMirror[recipient] += publicAmountWei;

        FHE.allowThis(_balances[msg.sender]);
        FHE.allowThis(_balances[recipient]);
        FHE.allowThis(transferValue);

        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allow(_balances[recipient], recipient);
        FHE.allow(transferValue, msg.sender);
        FHE.allow(transferValue, recipient);

        emit ConfidentialTransfer(
            msg.sender,
            recipient,
            keccak256(abi.encodePacked("transfer", msg.sender, recipient, block.number))
        );

        return transferValue;
    }

    /// @notice Move a confidential amount from the caller's encrypted balance into an encrypted savings bucket.
    /// @dev If the requested amount exceeds the caller balance, the actual moved amount becomes encrypted zero.
    function saveConfidential(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        uint64 publicAmountWei
    ) external returns (euint64) {
        if (publicAmountWei == 0) {
            revert InvalidAmount();
        }
        if (publicBalanceMirror[msg.sender] < publicAmountWei) {
            revert InvalidAmount();
        }

        euint64 requestedAmount = FHE.fromExternal(encryptedAmount, inputProof);
        ebool hasEnoughBalance = FHE.le(requestedAmount, _balances[msg.sender]);
        euint64 savingsValue = FHE.select(
            hasEnoughBalance,
            requestedAmount,
            FHE.asEuint64(0)
        );

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], savingsValue);
        _savings[msg.sender] = FHE.add(_savings[msg.sender], savingsValue);
        publicBalanceMirror[msg.sender] -= publicAmountWei;
        publicSavingsMirror[msg.sender] += publicAmountWei;

        FHE.allowThis(_balances[msg.sender]);
        FHE.allowThis(_savings[msg.sender]);
        FHE.allowThis(savingsValue);

        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allow(_savings[msg.sender], msg.sender);
        FHE.allow(savingsValue, msg.sender);

        emit ConfidentialSavings(
            msg.sender,
            keccak256(abi.encodePacked("savings", msg.sender, block.number))
        );

        return savingsValue;
    }

    /// @notice Create a simple escrow-style agreement with ETH locked publicly in the contract.
    function createAgreement(
        address recipient,
        uint256 deadline,
        bytes32 metadataHash
    ) external payable returns (uint256 agreementId) {
        if (recipient == address(0)) {
            revert InvalidRecipient();
        }
        if (msg.value == 0) {
            revert InvalidAmount();
        }
        if (deadline <= block.timestamp) {
            revert InvalidDeadline();
        }

        agreementId = nextAgreementId;
        nextAgreementId += 1;

        agreements[agreementId] = Agreement({
            creator: msg.sender,
            recipient: recipient,
            deadline: deadline,
            metadataHash: metadataHash,
            status: 0,
            amountWei: msg.value
        });

        emit AgreementCreated(
            agreementId,
            msg.sender,
            recipient,
            msg.value,
            deadline,
            metadataHash
        );
    }

    /// @notice Settle an agreement by releasing funds to the recipient or refunding the creator.
    /// @dev MVP rule: only the agreement creator can submit the verdict.
    function submitVerdict(uint256 agreementId, bool releaseFunds) external {
        Agreement storage agreement = agreements[agreementId];

        if (agreement.creator == address(0)) {
            revert AgreementNotFound();
        }
        if (agreement.creator != msg.sender) {
            revert NotAgreementCreator();
        }
        if (agreement.status != 0) {
            revert AgreementAlreadySettled();
        }
        if (address(this).balance < agreement.amountWei) {
            revert InsufficientContractLiquidity();
        }

        agreement.status = releaseFunds ? 1 : 2;
        address payoutRecipient = releaseFunds ? agreement.recipient : agreement.creator;

        (bool success, ) = payable(payoutRecipient).call{ value: agreement.amountWei }("");
        if (!success) {
            revert TransferFailed();
        }

        emit AgreementSettled(
            agreementId,
            agreement.creator,
            agreement.recipient,
            releaseFunds,
            agreement.status
        );
    }

    /// @notice Return the caller's encrypted internal balance handle.
    function getEncryptedBalance() external view returns (euint64) {
        return _balances[msg.sender];
    }

    /// @notice Return the caller's encrypted savings balance handle.
    function getEncryptedSavings() external view returns (euint64) {
        return _savings[msg.sender];
    }
}
