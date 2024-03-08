use crate::error::VestingRoyaleError;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer as SplTransfer};
use anchor_spl::token;

use crate::state::*;
use crate::utils::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateVestingArgs {
    /// The epoch that the vesting should start with. If None -> Start immediately
    pub start_epoch: Option<u64>,
    /// Number of Epochs to vest for End = start + delta
    pub end_epoch_delta: u64,
    /// How much of the vest is unlocked immediately in BPS (1% = 100)
    pub initial_vest: u16,
    /// Amount of tokens to vest
    pub amount: u64,
    /// Number of account to add
    pub recipient_count: u64,

}

#[derive(Accounts)]
#[instruction(args: CreateVestingArgs)]
pub struct CreateVesting<'info> {
    /// This is the config for this vesting royale
    #[account(
        init,
        payer = initializer,
        space = VestingRoyale::size(args.recipient_count as usize),
        seeds = [b"vestingroyale", initializer.key().as_ref()],
        bump
    )]
    pub vesting_royale: Account<'info, VestingRoyale>,

    /// Just the fee payer and pda seed. Has no special privs.
    #[account(mut)]
    pub initializer: Signer<'info>,

    /// Tokens that will be vested
    #[account(
        mut,
        token::mint = mint,
        token::authority = initializer
    )]
    pub initializer_token_account: Account<'info, TokenAccount>,

    /// Pool that will hold the tokens to be vested
    #[account(
        init_if_needed,
        payer = initializer,
        associated_token::mint = mint,
        associated_token::authority = vesting_royale,
    )]
    pub vesting_pool: Account<'info, TokenAccount>,

    /// Mint of the vested token
    pub mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    // Remainig Accounts here will be who receive vesting
    // use Address Lookup Tables if needed
}

impl CreateVesting<'_> {
    fn validate(&self, args: &CreateVestingArgs) -> Result<()> {
        require_gt!(10000, args.initial_vest, VestingRoyaleError::AnError);
        require_gt!(args.end_epoch_delta, 0, VestingRoyaleError::AnError);
        require_gt!(args.recipient_count, 0, VestingRoyaleError::AnError);
        Ok(())
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn handle(ctx: Context<Self>, args: CreateVestingArgs) -> Result<()> {
        let vr = &mut ctx.accounts.vesting_royale;

        vr.initializer = ctx.accounts.initializer.key();
        vr.bump = ctx.bumps.vesting_royale;
        vr.start_epoch = match args.start_epoch {
            Some(epoch) => {
                require_gt!(epoch, Clock::get().unwrap().epoch, VestingRoyaleError::AnError);
                epoch
            },
            None => Clock::get().unwrap().epoch,
        };
        vr.end_epoch = vr.start_epoch.saturating_add(args.end_epoch_delta);
        vr.vesting_pool = ctx.accounts.vesting_pool.key();
        vr.initial_vest = args.initial_vest;


        for account in ctx.remaining_accounts.iter() {
            vr.recipients.push(account.key())
        }

        require_eq!(vr.recipients.len() as u64, args.recipient_count, VestingRoyaleError::AnError);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: ctx.accounts.initializer_token_account.to_account_info(),
                    to: ctx.accounts.vesting_pool.to_account_info(), 
                    authority: ctx.accounts.initializer.to_account_info(),
                },
           ),
           args.amount,
       )
    }

}

