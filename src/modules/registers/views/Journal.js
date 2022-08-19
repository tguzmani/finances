import React, { useState } from 'react'
import Register from './Register'
import { useStoreState, useStoreActions } from 'easy-peasy'
import useRead from 'layout/hooks/useRead'
import Spinner from 'layout/Spinner'
import { Box, Pagination } from '@mui/material'
import usePagination from 'layout/hooks/usePagination'

const Journal = ({ preview }) => {
  const REGISTERS_PER_PAGE = 4
  const { registers, loading } = useStoreState(state => state.registers)
  const { readRegisters } = useStoreActions(state => state.registers)

  useRead(readRegisters)

  const {
    page,
    totalPages,
    handlePageChange,
    pageElements: pageRegisters,
    paginatorEl,
  } = usePagination(registers, REGISTERS_PER_PAGE)

  if (loading && registers.length === 0) return <Spinner />

  const thisRegisters = preview ? registers.slice(0, 5) : pageRegisters

  return (
    <>
      <Box ref={paginatorEl} mb={3} sx={{ height: '60vh', overflowY: 'auto' }}>
        {thisRegisters.map(register => (
          <Register key={register.id} register={register} />
        ))}
      </Box>

      {!preview && (
        <Pagination
          count={totalPages}
          shape='rounded'
          page={page}
          onChange={handlePageChange}
        />
      )}
    </>
  )
}

export default Journal
