const multer = require('multer')

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, 'public/tmp')
  },

  filename: (req, file, callback) => {
    const extension = file.mimetype.replace('image/', '')

    callback(null, `${req.userId}-logo.${extension}`)
  },
})

const handleImageUpload = multer({ storage }).any()

module.exports = handleImageUpload
