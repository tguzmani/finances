import { Stack, Box, Typography } from '@mui/material'
import { useStoreState } from 'easy-peasy'
import React from 'react'
import { grey } from '@mui/material/colors'
import { useTheme } from '@emotion/react'

const Amount = ({ value, greyedZeroes }) => {
  const { hideAmounts } = useStoreState(state => state.auth)
  const theme = useTheme()

  const amount = parseFloat(value)
  let color = 'inherit'
  let valueString = amount === 0 ? '0.00' : amount.toFixed(2)

  const isGreyedOut = greyedZeroes && amount === 0 && !hideAmounts

  color = isGreyedOut
    ? grey[800]
    : valueString < 0 && !hideAmounts
    ? theme.palette.error.main
    : color

  valueString =
    valueString < 0 ? `(${Math.abs(valueString).toFixed(2)})` : valueString

  return (
    <Box
      sx={{
        color,
      }}
    >
      {hideAmounts ? ' ******' : '$ ' + valueString}
    
    </Box>
  )
}

export default Amount
