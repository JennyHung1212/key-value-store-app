import { ErrorObject } from "ajv";
export const ajvErrorParser = async (
  validationErrors: ErrorObject[] | null | undefined
) => {
  const errors: Array<Object> = [];
  validationErrors?.forEach(({ params, keyword, message }) => {
    errors.push({
      param: params.missingProperty,
      key: keyword,
      message,
    });
  });

  return errors;
};
