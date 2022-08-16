import React from 'react'
import { useStoreActions } from 'easy-peasy'
import useRead from '../layout/hooks/useRead'
import Accounts from '../modules/accounts/views/Accounts'

const AccountsPage = () => {
  const { readAccounts } = useStoreActions(state => state.accounts)

  useRead(readAccounts)

  return <Accounts />
}

export default AccountsPage
