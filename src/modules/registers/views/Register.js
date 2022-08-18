import { Paper, Grid, Stack, Typography, Divider } from '@mui/material'
import React from 'react'
import dayjs from 'dayjs'
import RegisterRows from './RegisterRows'

const Register = ({ register }) => {
  console.log(dayjs(register.date))
  return (
    <Paper sx={{ margin: '1rem 0' }} variant='outlined'>
      <Grid container alignItems='center'>
        <Grid item xs={1}>
          <Stack>
            <Typography align='center' variant='body2'>
              {dayjs(register.date).format('MMMM')}
            </Typography>
            <Typography align='center' variant='h4'>
              {dayjs(register.date).format('DD')}
            </Typography>
          </Stack>
        </Grid>
        <Grid item xs={11}>
          <RegisterRows rows={register.rows} />
        </Grid>

        {register.description && (
          <Grid item xs={12}>
            <Divider />
            <Typography align='center' my={1} variant='body2'>
              {register.description}
            </Typography>
          </Grid>
        )}
      </Grid>
    </Paper>
  )
}

export default Register
