import React from 'react'

import { ListItem, ListItemText, Tooltip, Typography } from '@mui/material'
import Amount from '../../../layout/Amount'
import useRegisterById from '../../registers/hooks/useRegisterById'
import dayjs from 'dayjs'

const AccountTViewRow = ({ row }) => {
  const { register } = useRegisterById(row.registerId)

  const TooltipContent = ({ register }) => (
    <>
      <Typography variant='body2'>
        {dayjs(register.date).format('MM/DD')}
      </Typography>
      {register.description && (
        <Typography variant='body2'>{register.description}</Typography>
      )}
    </>
  )

  return (
    <ListItem sx={{ padding: 0.5 }}>
      <Tooltip
        title={<TooltipContent register={register} />}
        arrow
        placement={row.type === 'debit' ? 'left' : 'right'}
      >
        <ListItemText sx={{ textAlign: 'center' }}>
          <Amount value={row.amount} />
        </ListItemText>
      </Tooltip>
    </ListItem>
  )
}

export default AccountTViewRow
