import React from 'react'
import { Typography, Stack } from '@mui/material'
import AccountChip from './AccountChip'
import PageHeader from 'layout/PageHeader'

const AccountHeader = ({ account }) => {
  return (
    <>
      <PageHeader>{account?.name}</PageHeader>
      <Stack direction='row' mb={3} spacing={1}>
        <AccountChip property={account.classification} />
        <AccountChip property={account.type} />
      </Stack>
    </>
  )
}

export default AccountHeader
