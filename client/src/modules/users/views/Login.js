import React, { useEffect } from 'react'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import LoadingButton from '@mui/lab/LoadingButton'
import Typography from '@mui/material/Typography'

import { Link } from 'react-router-dom'

import useForm from './../../../layout/hooks/useForm'
import { useSelector, useDispatch } from 'react-redux'
import { signIn, setLoading } from './../users.auth.actions'
import useNavigateAfterAction from './../../../layout/hooks/useNavigateAfterAction'
// import routes from './../../../config/routes'

const Login = () => {
  const dispatch = useDispatch()
  const { loading } = useSelector(state => state.auth)

  const [credentials, bindCredentials, areFieldsEmpty] = useForm({
    username: process.env.REACT_APP_USERNAME || '',
    password: process.env.REACT_APP_PASSWORD || '',
  })

  const logginHasBeenHandled = useNavigateAfterAction(loading, '/')

  useEffect(() => {
    dispatch(setLoading(false))
  }, [])

  const handleLogIn = () => {
    dispatch(signIn(credentials))
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

            <LoadingButton
              variant='contained'
              onClick={handleLogIn}
              loading={loading}
              disabled={areFieldsEmpty}
            >
              Login
            </LoadingButton>

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
