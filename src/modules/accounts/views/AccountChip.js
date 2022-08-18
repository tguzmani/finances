import { Chip } from '@mui/material'
import React from 'react'

const AccountChip = ({ property, ...rest }) => {
  const chipColors = {
    assets: 'success',
    equity: 'info',
    liabilities: 'error',
    income: 'success',
    expenses: 'error',
    nominal: 'info',
    real: 'success',
  }

  const chipVariant = ['nominal', 'real'].includes(property) && 'outlined'

  const capitalizedProperty =
    property.charAt(0).toUpperCase() + property.slice(1)

  return (
    <Chip
      label={capitalizedProperty}
      color={chipColors[property]}
      variant={chipVariant}
      {...rest}
    />
  )
}

export default AccountChip
