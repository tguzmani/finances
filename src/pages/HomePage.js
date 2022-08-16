import React, { useEffect } from 'react'
import Typography from '@mui/material/Typography'

import { useStoreActions, useStoreState } from 'easy-peasy'

const Home = () => {
  const { user } = useStoreState(state => state.auth)

  const { readAccounts } = useStoreActions(state => state.accounts)

  useEffect(() => {
    readAccounts()
  }, [])

  return (
    <>
      <Typography my={3} gutterBottom variant='h2'>
        Hello, {user?.firstName}
      </Typography>
    </>
  )
}

export default Home
