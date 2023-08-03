import React, { useState } from 'react'
import Register from './Register'
import { useStoreState, useStoreActions } from 'easy-peasy'
import useRead from 'layout/hooks/useRead'
import Spinner from 'layout/Spinner'
import { Box, Button, Pagination, Stack, Typography } from '@mui/material'
import usePagination from 'layout/hooks/usePagination'
import { useNavigate } from 'react-router-dom'

const Journal = ({ preview }) => {
  const REGISTERS_PER_PAGE = 4

  const navigate = useNavigate()

  const { registers, loading } = useStoreState(state => state.registers)
  const { readRegisters } = useStoreActions(state => state.registers)
  const { readSubcategories } = useStoreActions(state => state.subcategories)

  useRead(readRegisters, readSubcategories)

  const {
    page,
    totalPages,
    handlePageChange,
    pageElements: pageRegisters,
    paginatedEl,
  } = usePagination(registers, REGISTERS_PER_PAGE)

  if (loading && registers.length === 0) return <Spinner />

  const thisRegisters = preview ? registers.slice(0, 4) : pageRegisters

  if (!loading && registers.length === 0)
    return <Typography variant='body1'>No registers</Typography>

  return (
    <>
      <Box
        ref={paginatedEl}
        mb={3}
        sx={{ height: '70vh', overflowY: 'auto', textAlign: 'center' }}
      >
        {thisRegisters.map(register => (
          <Register key={register.id} register={register} />
        ))}

        {preview && registers.length > REGISTERS_PER_PAGE && (
          <Button onClick={() => navigate('/journal')}>Go to journal</Button>
        )}
      </Box>

      {!preview && (
        <Stack alignItems='center'>
          <Pagination
            count={totalPages}
            shape='rounded'
            page={page}
            onChange={handlePageChange}
          />
        </Stack>
      )}
    </>
  )
}

export default Journal
