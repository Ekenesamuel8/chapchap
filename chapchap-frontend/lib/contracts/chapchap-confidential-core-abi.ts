export const CHAPCHAP_CONFIDENTIAL_CORE_ABI = [
    {
        "inputs":  [

                   ],
        "name":  "AgreementAlreadySettled",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "AgreementNotFound",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "DepositValueTooLarge",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InsufficientContractLiquidity",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidAmount",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidDeadline",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidRecipient",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "NotAgreementCreator",
        "type":  "error"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "bytes32",
                           "name":  "handle",
                           "type":  "bytes32"
                       },
                       {
                           "internalType":  "address",
                           "name":  "sender",
                           "type":  "address"
                       }
                   ],
        "name":  "SenderNotAllowedToUseHandle",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "TransferFailed",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "WithdrawalValueTooLarge",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "ZamaProtocolUnsupported",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "ZeroDeposit",
        "type":  "error"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "agreementId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "creator",
                           "type":  "address"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "recipient",
                           "type":  "address"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "amountWei",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "deadline",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "bytes32",
                           "name":  "metadataHash",
                           "type":  "bytes32"
                       }
                   ],
        "name":  "AgreementCreated",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "agreementId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "creator",
                           "type":  "address"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "recipient",
                           "type":  "address"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "bool",
                           "name":  "releasedFunds",
                           "type":  "bool"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint8",
                           "name":  "status",
                           "type":  "uint8"
                       }
                   ],
        "name":  "AgreementSettled",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "account",
                           "type":  "address"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "bytes32",
                           "name":  "encryptedAmountRef",
                           "type":  "bytes32"
                       }
                   ],
        "name":  "ConfidentialSavings",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "sender",
                           "type":  "address"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "recipient",
                           "type":  "address"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "bytes32",
                           "name":  "encryptedAmountRef",
                           "type":  "bytes32"
                       }
                   ],
        "name":  "ConfidentialTransfer",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "account",
                           "type":  "address"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "publicAmountWei",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "bytes32",
                           "name":  "encryptedBalanceRef",
                           "type":  "bytes32"
                       }
                   ],
        "name":  "Deposit",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "account",
                           "type":  "address"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "publicAmountWei",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "bytes32",
                           "name":  "encryptedBalanceRef",
                           "type":  "bytes32"
                       }
                   ],
        "name":  "Withdrawal",
        "type":  "event"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "agreementId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "agreements",
        "outputs":  [
                        {
                            "internalType":  "address",
                            "name":  "creator",
                            "type":  "address"
                        },
                        {
                            "internalType":  "address",
                            "name":  "recipient",
                            "type":  "address"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "deadline",
                            "type":  "uint256"
                        },
                        {
                            "internalType":  "bytes32",
                            "name":  "metadataHash",
                            "type":  "bytes32"
                        },
                        {
                            "internalType":  "uint8",
                            "name":  "status",
                            "type":  "uint8"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "amountWei",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "confidentialProtocolId",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "recipient",
                           "type":  "address"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "deadline",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "bytes32",
                           "name":  "metadataHash",
                           "type":  "bytes32"
                       }
                   ],
        "name":  "createAgreement",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "agreementId",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "payable",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "deposit",
        "outputs":  [

                    ],
        "stateMutability":  "payable",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "getEncryptedBalance",
        "outputs":  [
                        {
                            "internalType":  "euint64",
                            "name":  "",
                            "type":  "bytes32"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "getEncryptedSavings",
        "outputs":  [
                        {
                            "internalType":  "euint64",
                            "name":  "",
                            "type":  "bytes32"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "nextAgreementId",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "account",
                           "type":  "address"
                       }
                   ],
        "name":  "publicBalanceMirror",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "amountWei",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "account",
                           "type":  "address"
                       }
                   ],
        "name":  "publicSavingsMirror",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "amountWei",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "externalEuint64",
                           "name":  "encryptedAmount",
                           "type":  "bytes32"
                       },
                       {
                           "internalType":  "bytes",
                           "name":  "inputProof",
                           "type":  "bytes"
                       },
                       {
                           "internalType":  "uint64",
                           "name":  "publicAmountWei",
                           "type":  "uint64"
                       }
                   ],
        "name":  "saveConfidential",
        "outputs":  [
                        {
                            "internalType":  "euint64",
                            "name":  "",
                            "type":  "bytes32"
                        }
                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "agreementId",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "bool",
                           "name":  "releaseFunds",
                           "type":  "bool"
                       }
                   ],
        "name":  "submitVerdict",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "totalPublicDepositsWei",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "recipient",
                           "type":  "address"
                       },
                       {
                           "internalType":  "externalEuint64",
                           "name":  "encryptedAmount",
                           "type":  "bytes32"
                       },
                       {
                           "internalType":  "bytes",
                           "name":  "inputProof",
                           "type":  "bytes"
                       },
                       {
                           "internalType":  "uint64",
                           "name":  "publicAmountWei",
                           "type":  "uint64"
                       }
                   ],
        "name":  "transferConfidential",
        "outputs":  [
                        {
                            "internalType":  "euint64",
                            "name":  "",
                            "type":  "bytes32"
                        }
                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint64",
                           "name":  "publicAmountWei",
                           "type":  "uint64"
                       }
                   ],
        "name":  "withdraw",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    }
] as const;

