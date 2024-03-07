use crate::error::VestingRoyaleError;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer as SplTransfer};
use anchor_spl::token;

use crate::state::*;
use crate::utils::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TakeArgs {
}

#[derive(Accounts)]
pub struct Take<'info> {
    /// This is the config for this vesting royale
    #[account(mut, has_one = initializer, has_one = vesting_pool)]
    pub vesting_royale: Account<'info, VestingRoyale>,
    pub initializer: UncheckedAccount<'info>,

    /// Taker who is a valid recipient
    #[account(mut)]
    pub taker: Signer<'info>,

    /// Tokens Account to extract to
    #[account(mut, token::mint = mint)]
    pub taker_token_account: Account<'info, TokenAccount>,

    /// Pool that will hold the tokens to be vested
    #[account(mut, token::mint = mint)]
    pub vesting_pool: Account<'info, TokenAccount>,

    /// Mint of the vested token
    pub mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

impl Take<'_> {
    pub fn handle(ctx: Context<Self>, args: TakeArgs) -> Result<()> {
        let vr = &mut ctx.accounts.vesting_royale;
        let allocation = vr.take(ctx.accounts.taker.key(), ctx.accounts.vesting_pool.amount)?;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: ctx.accounts.vesting_pool.to_account_info(),
                    to: ctx.accounts.taker_token_account.to_account_info(), 
                    authority: ctx.accounts.vesting_pool.to_account_info(),
                },
                &[&[b"vestingroyale", ctx.accounts.initializer.key().as_ref()], &[&[ctx.bumps["vesting_royale"]]]]
           ),
           allocation,
       )
    }
}

