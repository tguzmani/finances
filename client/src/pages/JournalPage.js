import Journal from 'modules/registers/views/Journal'
import React from 'react'
import useRead from 'layout/hooks/useRead'
import { useStoreActions } from 'easy-peasy'
import { Typography } from '@mui/material'
import PageHeader from 'layout/PageHeader'
import PageWithSidePanel from 'layout/pages/PageWithSidePanel'
import JournalSidePanel from 'modules/registers/views/JournalSidePanel'

const JournalPage = () => {
  const { readAccounts } = useStoreActions(state => state.accounts)

  useRead(readAccounts)

  return (
    <PageWithSidePanel SidePanel={JournalSidePanel}>
      <PageHeader>Journal</PageHeader>
      <Journal />
    </PageWithSidePanel>
  )
}

export default JournalPage
