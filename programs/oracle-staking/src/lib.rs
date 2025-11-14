use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod oracle_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, min_stake: u64) -> Result<()> {
        let staking_pool = &mut ctx.accounts.staking_pool;
        staking_pool.authority = ctx.accounts.authority.key();
        staking_pool.min_stake = min_stake;
        staking_pool.total_staked = 0;
        staking_pool.total_nodes = 0;
        staking_pool.bump = ctx.bumps.staking_pool;
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(
            amount >= ctx.accounts.staking_pool.min_stake,
            StakingError::InsufficientStake
        );

        let staking_pool = &mut ctx.accounts.staking_pool;
        let node_stake = &mut ctx.accounts.node_stake;

        // Transfer SOL from user to staking pool
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.user.key(),
                &ctx.accounts.staking_pool.key(),
                amount,
            ),
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.staking_pool.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Update node stake
        if node_stake.amount == 0 {
            staking_pool.total_nodes += 1;
        }
        node_stake.amount += amount;
        node_stake.staked_at = Clock::get()?.unix_timestamp;
        node_stake.last_update = Clock::get()?.unix_timestamp;
        node_stake.node_address = ctx.accounts.user.key();

        // Update pool totals
        staking_pool.total_staked += amount;

        emit!(StakeEvent {
            node: ctx.accounts.user.key(),
            amount,
            total_staked: staking_pool.total_staked,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        let node_stake = &mut ctx.accounts.node_stake;
        let staking_pool = &mut ctx.accounts.staking_pool;

        require!(
            node_stake.amount >= amount,
            StakingError::InsufficientBalance
        );

        // Update node stake
        node_stake.amount -= amount;
        node_stake.last_update = Clock::get()?.unix_timestamp;

        // If fully unstaked, remove node
        if node_stake.amount == 0 {
            staking_pool.total_nodes = staking_pool.total_nodes.saturating_sub(1);
        }

        // Update pool totals
        staking_pool.total_staked = staking_pool.total_staked.saturating_sub(amount);

        // Transfer SOL back to user
        let seeds = &[
            b"staking_pool",
            &[staking_pool.bump],
        ];
        let signer = &[&seeds[..]];

        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.staking_pool.key(),
                &ctx.accounts.user.key(),
                amount,
            ),
            &[
                ctx.accounts.staking_pool.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;

        emit!(UnstakeEvent {
            node: ctx.accounts.user.key(),
            amount,
            remaining_stake: node_stake.amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn slash_node(ctx: Context<SlashNode>, slash_amount: u64) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.staking_pool.authority,
            StakingError::Unauthorized
        );

        let node_stake = &mut ctx.accounts.node_stake;
        let staking_pool = &mut ctx.accounts.staking_pool;

        let actual_slash = slash_amount.min(node_stake.amount);
        
        node_stake.amount = node_stake.amount.saturating_sub(actual_slash);
        node_stake.last_update = Clock::get()?.unix_timestamp;

        if node_stake.amount == 0 {
            staking_pool.total_nodes = staking_pool.total_nodes.saturating_sub(1);
        }

        staking_pool.total_staked = staking_pool.total_staked.saturating_sub(actual_slash);

        emit!(SlashEvent {
            node: node_stake.node_address,
            amount: actual_slash,
            remaining_stake: node_stake.amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + StakingPool::LEN,
        seeds = [b"staking_pool"],
        bump
    )]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + NodeStake::LEN,
        seeds = [b"node_stake", user.key().as_ref()],
        bump
    )]
    pub node_stake: Account<'info, NodeStake>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(
        mut,
        seeds = [b"node_stake", user.key().as_ref()],
        bump
    )]
    pub node_stake: Account<'info, NodeStake>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SlashNode<'info> {
    #[account(mut)]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(mut)]
    pub node_stake: Account<'info, NodeStake>,
    pub authority: Signer<'info>,
}

#[account]
pub struct StakingPool {
    pub authority: Pubkey,
    pub min_stake: u64,
    pub total_staked: u64,
    pub total_nodes: u64,
    pub bump: u8,
}

impl StakingPool {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 1;
}

#[account]
pub struct NodeStake {
    pub node_address: Pubkey,
    pub amount: u64,
    pub staked_at: i64,
    pub last_update: i64,
}

impl NodeStake {
    pub const LEN: usize = 32 + 8 + 8 + 8;
}

#[event]
pub struct StakeEvent {
    pub node: Pubkey,
    pub amount: u64,
    pub total_staked: u64,
    pub timestamp: i64,
}

#[event]
pub struct UnstakeEvent {
    pub node: Pubkey,
    pub amount: u64,
    pub remaining_stake: u64,
    pub timestamp: i64,
}

#[event]
pub struct SlashEvent {
    pub node: Pubkey,
    pub amount: u64,
    pub remaining_stake: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum StakingError {
    #[msg("Insufficient stake amount")]
    InsufficientStake,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Unauthorized")]
    Unauthorized,
}


