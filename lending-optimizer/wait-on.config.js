module.exports = {
    validateStatus: function (status) {
        return status >= 200 && status < 500; // default if not provided
    },
};