module.exports.successResponse = function successResponse(message, data) {
    return {
        success: true,
        result: {
            data: data || null,
            message: message.toString() || 'OK',
        },
    }
}
module.exports.errorResponse = function errorResponse(message) {
    return {
        success: false,
        result: {
            data: null,
            message: message.toString() || 'Error',
        }
    }
}