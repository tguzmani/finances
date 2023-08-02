import React, { useEffect } from 'react'
import { Typography, Grid } from '@mui/material'

import { useStoreActions, useStoreState } from 'easy-peasy'
import Journal from '../modules/registers/views/Journal'
import CreateRegisterTextbox from '../modules/registers/views/CreateRegisterTextbox'
import HomeSidePanel from 'layout/HomeSidePanel'
import useRead from 'layout/hooks/useRead'
import PageHeader from 'layout/PageHeader'
import PageWithSidePanel from 'layout/pages/PageWithSidePanel'

const Home = () => {
  const { user } = useStoreState(state => state.auth)

  const { readAccounts } = useStoreActions(state => state.accounts)

  useRead(readAccounts)

  return (
    <PageWithSidePanel SidePanel={HomeSidePanel}>
      <PageHeader>Hello, {user?.firstName}</PageHeader>
      <CreateRegisterTextbox />

      <Typography mt={3} mb={1} variant='h5'>
        Last registers
      </Typography>
      <Journal preview />
    </PageWithSidePanel>
  )
}

export default Home
