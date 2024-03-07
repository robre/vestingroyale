use anchor_lang::prelude::*;

#[error_code]
pub enum VestingRoyaleError {
    #[msg("Some thing is wrong")]
    AnError,
    #[msg("Invalid Amount")]
    InvalidAmount,
    #[msg("There is not enough liquid Meta to withdraw at the moment.")]
    MetaLiquidityMissing,
    #[msg("There is not enough liquid USDC to withdraw at the moment.")]
    USDCLiquidityMissing,
    #[msg("Accounts bad")]
    InvalidAccounts,
}



