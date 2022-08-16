import {
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import React from 'react'
import Amount from '../../../layout/Amount'

const AccountTView = ({ account }) => {
  const debits = [1000, 500, 10]
  const credits = [17, 500, 10, 11, 12, 10]

  return (
    <Grid container>
      <Grid item xs={6}>
        <Typography mb={1} align='center' variant='h6'>
          Debit
        </Typography>
      </Grid>

      <Grid item xs={6}>
        <Typography mb={1} align='center' variant='h6'>
          Credit
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Divider />
      </Grid>

      <Grid item xs={6}>
        <List>
          {debits.map(debit => (
            <ListItem sx={{ padding: 0.5 }}>
              <ListItemText sx={{ textAlign: 'center' }}>
                <Amount value={debit} />
              </ListItemText>
            </ListItem>
          ))}
        </List>
      </Grid>

      <Grid item xs={6}>
        <List>
          {credits.map(credit => (
            <ListItem sx={{ padding: 0.5 }}>
              <ListItemText sx={{ textAlign: 'center' }}>
                <Amount value={credit} />
              </ListItemText>
            </ListItem>
          ))}
        </List>
      </Grid>

      <Grid item xs={12}>
        <Divider />
      </Grid>

      <Grid item xs={6} my={1}>
        <Typography align='center' variant='h6'>
          <Amount value={1510} />
        </Typography>
      </Grid>

      <Grid item xs={6} my={1}>
        <Typography align='center' variant='h6'>
          <Amount value={670} />
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Divider />
      </Grid>

      <Grid item xs={6} my={1}>
        <Typography align='center' variant='h5'>
          <Amount value={1510 - 670} />
        </Typography>
      </Grid>

      <Grid item xs={6} my={1}>
        <Typography align='center' variant='h5'>
          <Amount value={1510 - 670} />
        </Typography>
      </Grid>
    </Grid>
  )
}

export default AccountTView
