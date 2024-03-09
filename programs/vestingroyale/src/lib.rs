pub use anchor_lang;
use anchor_lang::prelude::*;

pub use instructions::*;
pub use state::*;

pub mod error;
pub mod instructions;
pub mod state;

declare_id!("2FG7tvMgxAYX3ZF1Zg1Cz36TSwyFrNvN5ipXJd9Yb8Ji");

#[program]
pub mod vestingroyale {
    use super::*;

    pub fn create_vesting(ctx: Context<CreateVesting>, args: CreateVestingArgs) -> Result<()> {
        CreateVesting::handle(ctx, args)
    }

    pub fn take(ctx: Context<Take>, args: TakeArgs) -> Result<()> {
        Take::handle(ctx, args)
    }
}
