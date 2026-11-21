const AppError = require('../utils/AppError');

// validate(schema, 'body' | 'query' | 'params')
module.exports = (schema, source = 'body') => (req, _res, next) => {
  const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message.replace(/"/g, '') }));
    return next(new AppError('Validation failed', 400, details));
  }
  req[source] = value;
  next();
};
