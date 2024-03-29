import { useState, useRef } from 'react'

const usePagination = (elements, elementsPerPage) => {
  const [page, setPage] = useState(1)
  const paginatedEl = useRef()

  const totalElements = elements.length
  const totalPages = Math.round(totalElements / elementsPerPage)
  const isLastPage = page === totalPages
  const areMoreElementsInLastPage =
    isLastPage && elements.length > page * elementsPerPage

  const handlePageChange = (event, value) => {
    setPage(value)
    paginatedEl.current.scrollTo(0, 0)
  }

  const pageElements = elements.slice(
    elementsPerPage * (page - 1),
    areMoreElementsInLastPage ? elements.length : elementsPerPage * page
  )

  return { page, totalPages, handlePageChange, pageElements, paginatedEl }
}

export default usePagination
