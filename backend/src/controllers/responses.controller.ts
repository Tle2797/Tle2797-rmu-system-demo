import {
  ResponseSubmissionError,
  submitSurveyResponse,
} from "../services/response-submission";

export async function submitResponse({ body, set }: any) {
  try {
    const result = await submitSurveyResponse(body as Record<string, unknown>);
    set.status = 201;
    return result;
  } catch (error) {
    if (error instanceof ResponseSubmissionError) {
      set.status = error.status;
      return error.body;
    }

    throw error;
  }
}
