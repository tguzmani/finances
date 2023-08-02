import { useStoreState } from 'easy-peasy'
import React, { cloneElement } from 'react'

const useSubcategoryById = subcategoryId => {
  const { subcategories } = useStoreState(state => state.subcategories)

  const subcategory = subcategories.find(
    subcategory => subcategory.id === subcategoryId
  )

  return { subcategory }
}

export default useSubcategoryById
