import React, { useEffect } from 'react'
import { Typography, Grid } from '@mui/material'

import { useStoreActions, useStoreState } from 'easy-peasy'
import Journal from '../modules/registers/views/Journal'
import CreateRegisterTextbox from '../modules/registers/views/CreateRegisterTextbox'
import HomeSidePanel from 'layout/HomeSidePanel'
import useRead from 'layout/hooks/useRead'
import PageHeader from 'layout/PageHeader'

const Home = () => {
  const { user } = useStoreState(state => state.auth)

  const { readAccounts } = useStoreActions(state => state.accounts)

  useRead(readAccounts)

  return (
    <>
      <Grid container spacing={4}>
        <Grid xs={9} item>
          <PageHeader>Hello, {user?.firstName}</PageHeader>
          <CreateRegisterTextbox />

          <Typography mt={3} variant='h5'>
            Last registers
          </Typography>
          <Journal preview />
        </Grid>
        <Grid mt={3} xs={3} item>
          <HomeSidePanel />
        </Grid>
      </Grid>
    </>
  )
}

export default Home
