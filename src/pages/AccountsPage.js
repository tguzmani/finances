import React from 'react'
import { useStoreActions } from 'easy-peasy'
import useRead from 'layout/hooks/useRead'
import AccountsTable from '../modules/accounts/views/AccountsTable'
import { Grid } from '@mui/material'
import AccountsSidePanel from '../modules/accounts/views/AccountsSidePanel'
import PageHeader from 'layout/PageHeader'
import PageWithSidePanel from 'layout/pages/PageWithSidePanel'

const AccountsPage = () => {
  const { readAccounts } = useStoreActions(state => state.accounts)
  const { readRegisters } = useStoreActions(state => state.registers)

  useRead(readAccounts, readRegisters)

  return (
    <PageWithSidePanel SidePanel={AccountsSidePanel}>
      <PageHeader>Accounts</PageHeader>
      <AccountsTable />
    </PageWithSidePanel>
  )
}

export default AccountsPage
