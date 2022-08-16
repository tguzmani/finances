import React from 'react'
import { useStoreActions } from 'easy-peasy'
import useRead from '../layout/hooks/useRead'
import AccountsTable from '../modules/accounts/views/AccountsTable'
import { Grid, Typography } from '@mui/material'
import AccountsSidePanel from '../modules/accounts/views/AccountsSidePanel'

const AccountsPage = () => {
  const { readAccounts } = useStoreActions(state => state.accounts)

  useRead(readAccounts)

  return (
    <>
      <Grid container spacing={4}>
        <Grid mt={3} xs={9} item>
          <AccountsTable />
        </Grid>
        <Grid mt={3} xs={3} item>
          <AccountsSidePanel />
        </Grid>
      </Grid>
    </>
  )
}

export default AccountsPage
