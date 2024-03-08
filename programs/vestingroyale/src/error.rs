use anchor_lang::prelude::*;

#[error_code]
pub enum VestingRoyaleError {
    #[msg("Some thing is wrong")]
    AnError,
    #[msg("Invalid Amount")]
    InvalidAmount,
    #[msg("Accounts bad")]
    InvalidAccounts,
}



