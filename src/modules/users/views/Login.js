import React, { useEffect } from 'react'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import { Stack, Button } from '@mui/material'
import Typography from '@mui/material/Typography'

import { Link } from 'react-router-dom'

import useForm from 'layout/hooks/useForm'
import useNavigateAfterAction from 'layout/hooks/useNavigateAfterAction'

import { useStoreActions, useStoreState } from 'easy-peasy'

const Login = () => {
  const { loading } = useStoreState(state => state.auth)
  const { signIn, setLoading } = useStoreActions(actions => actions.auth)

  const [credentials, bindCredentials, areFieldsEmpty] = useForm({
    username: process.env.REACT_APP_USERNAME || '',
    password: process.env.REACT_APP_PASSWORD || '',
  })

  const logginHasBeenHandled = useNavigateAfterAction(loading, '/')

  useEffect(() => {
    setLoading(false)
  }, [])

  const handleLogIn = () => {
    signIn(credentials)
    logginHasBeenHandled()
  }

  return (
    <Box
      sx={{
        backgroundImage: 'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)',
        height: '100vh',
      }}
    >
      <Grid
        pt={25}
        container
        sx={{ height: '100%' }}
        justifyContent='center'
        alignItems='flex-start'
      >
        <Paper sx={{ width: '350px', padding: '1.5rem' }}>
          <Stack spacing={3}>
            <Typography align='center' variant='h4'>
              Login
            </Typography>
            <TextField
              fullWidth
              label='Username'
              {...bindCredentials('username')}
            />
            <TextField
              fullWidth
              label='Password'
              type='password'
              {...bindCredentials('password')}
            />

            <Button
              variant='contained'
              onClick={handleLogIn}
              // loading={loading}
              disabled={areFieldsEmpty}
            >
              Login
            </Button>

            <Typography align='center' variant='body2'>
              Not a member? <Link to='/register'>Signup</Link>
            </Typography>
          </Stack>
        </Paper>
      </Grid>
    </Box>
  )
}

export default Login
