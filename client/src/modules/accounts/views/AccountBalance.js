import React from 'react'
import { Typography, Grid } from '@mui/material'
import Amount from 'layout/Amount'
import useAccountTotals from '../hooks/useAccountTotals'

const AccountBalance = ({ account }) => {
  const { balance, initialBalance } = useAccountTotals(account)

  return (
    <>
      <Grid container spacing={1}>
        {account.classification !== 'nominal' && (
          <>
            {' '}
            <Grid xs={3} item>
              <Typography variant='body1'>Initial Balance</Typography>
            </Grid>
            <Grid item xs={9}>
              <Typography variant='body1'>
                <Amount value={initialBalance} />
              </Typography>
            </Grid>
          </>
        )}

        <Grid xs={3} item>
          <Typography variant='body1'>Current Balance</Typography>
        </Grid>

        <Grid item xs={9}>
          <Typography variant='body1'>
            <Amount value={balance} />
          </Typography>
        </Grid>
      </Grid>
    </>
  )
}

export default AccountBalance
