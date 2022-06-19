const resource = 'USERS'

const types = [
  'LOADING',
  'ERROR',
  'SIGN_IN',
  'SIGN_OUT',
  'READ_USER_BY_ID',
  'SIGN_UP',
]

let thisResourceTypes = {}

types.forEach(
  type =>
    (thisResourceTypes = {
      ...thisResourceTypes,
      [type]: `${resource}/${type}`,
    })
)

export default thisResourceTypes
