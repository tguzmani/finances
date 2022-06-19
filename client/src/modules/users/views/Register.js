import React, { useEffect } from 'react'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import LoadingButton from '@mui/lab/LoadingButton'
import Typography from '@mui/material/Typography'
import { format } from 'date-fns'

import { Link } from 'react-router-dom'

import useForm from '../../../layout/hooks/useForm'
import { useSelector, useDispatch } from 'react-redux'
import { signUp, setLoading } from '../users.auth.actions'
import useNavigateAfterAction from '../../../layout/hooks/useNavigateAfterAction'
import DatePicker from '@mui/lab/DatePicker'

const Login = () => {
  const dispatch = useDispatch()
  const { loading } = useSelector(state => state.auth)

  const [birthDate, setBirthDate] = React.useState(null)

  const [user, bindUser, areFieldsEmpty] = useForm({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const signupHasBeenHandled = useNavigateAfterAction(loading, '/login')

  useEffect(() => {
    dispatch(setLoading(false))
  }, [])

  const handleSignup = () => {
    dispatch(signUp({ ...user, birthDate: format(birthDate, 'yyyy-MM-dd') }))
    signupHasBeenHandled()
  }

  return (
    <Box
      sx={{
        backgroundImage: 'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)',
        height: '100vh',
      }}
    >
      <Grid
        pt={12}
        container
        sx={{ height: '100%' }}
        justifyContent='center'
        alignItems='flex-start'
      >
        <Paper sx={{ width: '350px', padding: '1.5rem' }}>
          <Stack spacing={3}>
            <Typography align='center' variant='h4'>
              Register
            </Typography>
            <TextField fullWidth label='Username' {...bindUser('username')} />
            <TextField
              fullWidth
              label='First name'
              {...bindUser('firstName')}
            />

            <TextField fullWidth label='Last name' {...bindUser('lastName')} />

            <DatePicker
              label='Birth date'
              value={birthDate}
              maxDate={new Date()}
              onChange={date => {
                setBirthDate(date)
              }}
              renderInput={params => <TextField {...params} />}
            />

            <TextField
              fullWidth
              label='Email'
              type='email'
              {...bindUser('email')}
            />

            <TextField
              fullWidth
              label='Password'
              type='password'
              {...bindUser('password')}
            />

            <TextField
              fullWidth
              label='Confirm password'
              type='password'
              {...bindUser('confirmPassword')}
            />

            <LoadingButton
              variant='contained'
              onClick={handleSignup}
              loading={loading}
              disabled={areFieldsEmpty}
            >
              Signup
            </LoadingButton>

            <Typography align='center' variant='body2'>
              Already a member? <Link to='/login'>Login</Link>
            </Typography>
          </Stack>
        </Paper>
      </Grid>
    </Box>
  )
}

export default Login
