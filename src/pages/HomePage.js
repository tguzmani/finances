import React, { useEffect } from 'react'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'

import { useStoreActions, useStoreState } from 'easy-peasy'

const Home = () => {
  const { user } = useStoreState(state => state.auth)

  const { readAccounts } = useStoreActions(state => state.accounts)
  const { accounts } = useStoreState(state => state.accounts)

  useEffect(() => {
    readAccounts()
  }, [])

  return (
    <Container>
      <Typography gutterBottom variant='h4'>
        Hello, {user?.firstName}
      </Typography>
      Las cuentas son: {JSON.stringify(accounts)}
    </Container>
  )
}

export default Home
