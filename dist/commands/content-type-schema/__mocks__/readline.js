let responseQueue = [];
module.exports = {
    createInterface: jest.fn().mockReturnValue({
        question: jest.fn().mockImplementation((questionText, cb) => {
            console.log(questionText);
            if (responseQueue.length == 0) {
                throw new Error('Too many responses given.');
            }
            cb(responseQueue[0]);
            responseQueue.splice(0, 1);
        }),
        close: () => true
    }),
    setResponses: (responses) => {
        responseQueue = responses;
    },
    addResponse: (response) => responseQueue.push(response),
    responsesLeft: () => responseQueue.length
};
