import Journal from 'modules/registers/views/Journal'
import React from 'react'
import useRead from 'layout/hooks/useRead'
import { useStoreActions } from 'easy-peasy'
import { Typography } from '@mui/material'
import PageHeader from 'layout/PageHeader'

const JournalPage = () => {
  const { readAccounts } = useStoreActions(state => state.accounts)

  useRead(readAccounts)

  return (
    <>
      <PageHeader>Journal</PageHeader>
      <Journal />
    </>
  )
}

export default JournalPage
