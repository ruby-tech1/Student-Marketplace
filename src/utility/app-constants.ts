export default class AppConstants {
    static readonly PASSWORD_REGEX =
        /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
    static readonly NAME_REGEX = /^[a-zA-Z0-9 ]+$/;
    static readonly SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    static readonly PAGE_LIMIT = 10;
    static readonly PAGE = 1;
    static readonly PAGE_SORT = 'createdAt';
    static readonly PAGE_ORDER = 'DESC';
    static readonly PAGE_SEARCH = '';

    static readonly APP_GLOBAL_PREFIX = 'api/v1';
}
