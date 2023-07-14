const RowException = require('./rows.exception')
const accountsServices = require('../accounts/accounts.services')
const subcategoriesServices = require('../subcategories/subcategories.services')

exports.parseRowFromScriptLine = async line => {
  const type = line[0]

  const accountName = line[1]
  const account = await accountsServices.readAccountByName(accountName)

  if (!account) throw new RowException(`Account '${accountName}' not found`)
  const accountId = account.id

  const amountValue = line[2]
  const amountRegex = /^([-+/*]\d+(\.\d+)?)*/

  if (!amountValue.match(amountRegex))
    throw new RowException('Amount is not a valid mathematical expression')

  const amount = eval(amountValue)

  const subcategoryName = line[3]

  let subcategory

  if (subcategoryName) {
    subcategory = await subcategoriesServices.readSubcategoryByName(
      subcategoryName
    )

    if (!subcategory)
      throw new RowException(`Subcatagory '${subcategoryName}' not found`)
  }

  const subcategoryId = subcategory?.id

  const row = { type, accountId, amount, subcategoryId }

  return row
}
