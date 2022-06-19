import React from 'react'
import Button from '@mui/material/Button'
import { useDispatch, useSelector } from 'react-redux'
import { signIn } from '../modules/users/users.auth.actions'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'

const Home = () => {
  const { user } = useSelector(state => state.auth)

  return (
    <Container>
      <Typography gutterBottom variant='h4'>
        Hello, {user?.firstName}
      </Typography>
      <Typography variant='body1'>
        This is the front-end of the Tom Full Stack Template. Before you start
        your journey:
        <ul>
          <li>
            Setup <code>favicon.ico</code>
          </li>
          <li>
            Setup <code>manifest.json</code>
          </li>
          <li>
            Setup default application title in <code>public/index.html</code>
          </li>
        </ul>
      </Typography>

      <Divider />

      <Typography mt={3} variant='body1'>
        Some features are missing, such as:
        <ul>
          <li>
            Register form validation:
            <ul>
              <li>Passwords match</li>
              <li>Username is taken</li>
              <li>Password strength</li>
            </ul>
          </li>
          <li>User settings</li>
          <li>Drawer</li>
        </ul>
      </Typography>
    </Container>
  )
}

export default Home
