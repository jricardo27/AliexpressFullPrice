// ==UserScript==
// @name         Aliexpress Full Price
// @author       Ricardo Perez
// @namespace    jricardo27/AliexpressFullPrice
// @version      1.0
// @license      GPL-3.0
// @description  Show full price (including shipping and Australian Taxes) on item list.
// @include      *://*.aliexpress.*
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @grant        none
// ==/UserScript==

'use strict';

var CURRENCY_SELECTOR = "span.currency";
var LIST_SELECTOR = ".list-items";
var ITEM_LIST_SHIPPING_SELECTOR = ".shipping-value";
var ITEM_LIST_PRICE_SELECTOR = "span.price-current";

var QUANTITY_SELECTOR = ".product-number-picker input";
var PRODUCT_SHIPPING_SELECTOR = ".product-shipping-price";
var PRODUCT_PRICE_SELECTOR = ".product-price-value";
var RIGHT_HEADER_SELECTOR = ".header-right-content";
var MESSAGE_ELEMENT_ID = "aliexpressfullprice-message";
var DATA_LOWER_PRICE = 'data-lower-price';
var DATA_UPPER_PRICE = 'data-upper-price';

var obsConfig = {
    childList: true,
    characterData: true,
    attributes: true,
    subtree: true
};
var itemsAlreadySorted = false;


function showMessage(message) {
    var html = "<span id='" + MESSAGE_ELEMENT_ID + "' " +
        "style='float: left; font-size: 14px; color: blueviolet'>" +
        message +
        "</span>";

    var container = $(RIGHT_HEADER_SELECTOR);
    container.find('#' + MESSAGE_ELEMENT_ID).remove();

    container.append(html);
}

function clearMessage() {
    $(RIGHT_HEADER_SELECTOR).find('#' + MESSAGE_ELEMENT_ID).remove();
}

function getCurrency() {
    var currency = "";
    var element = $(CURRENCY_SELECTOR);

    if (element && element.text()) {
        currency = element.text();
    }

    return currency;
}

function getPrices(item, price_selector) {
    var prices = [];
    var textPrice = item.find(price_selector).text();

    if (!textPrice) {
        console.log("Couldn't extract price: " + item.find("span.price-current").html());
    }

    var matches = textPrice.match(/\$(\d+\.?\d*)(?: \- )?(\d+\.?\d*)?/);

    if (matches && matches[1]) {
        prices.push(Number(matches[1]));

        if (matches[2]) {
            prices.push(Number(matches[2]));
        }
    } else {
        console.log("Couldn't find prices for item. [" + textPrice + "]");
    }

    return prices;
}

function getShipping(item, shipping_selector) {
    var shippingCost = 0;
    var shippingItem = item.find(shipping_selector);

    if (shippingItem) {
        var textValue = shippingItem.text();

        var matches = textValue.match(/\$(\d+\.?\d*)/);

        if (matches) {
            shippingCost = Number(matches[1]);
        } else {
            // Free shipping.
            // console.log("Couldn't find shipping price for item. [" + shippingItem.html() + "]");
        }
    }

    return shippingCost;
}

function addNewPrice(item, currency, prices, quantity, shipping, tax, price_selector, shipping_selector) {
    var priceTag = $(item.find(price_selector)[0]);
    var shippingTag = $(item.find(shipping_selector)[0]);
    var newPrices = [];

    $.each([priceTag, shippingTag], function (index, tag) {
        tag.css("font-size", "8px");
        tag.css("color", "lightgrey");
    });

    var newContent = "<span class='total-price-updated'>";
    newContent += "<span style='font-size: 8px; color: blueviolet'>" +
        "AliexpressFullPrice plugin activated" +
        "</span>" +
        "<br>";

    if (tax > 1) {
        newContent += "<span style='font-size: 10px'>" +
            "(Shipping + AU Tax included)" +
            "</span>" +
            "<br>";
    } else {
        newContent += "<span style='font-size: 10px'>" +
            "(Shipping included)" +
            "</span>" +
            "<br>";
    }

    $.each(prices, function (index, price) {
        var singlePrice = "";
        var newPrice = ((price * quantity) + shipping) * tax;
        newPrices.push(newPrice);

        if (quantity > 1) {
            singlePrice = newPrice / quantity;
            singlePrice = "<span style='font-size: 10px'>" +
                " (1 pc: " + singlePrice.toFixed(2) + ")" +
                "</span>";
        }

        newContent += "<span class='price-current'>" +
            currency + " $" + newPrice.toFixed(2) +
            singlePrice +
            "</span>" +
            "<br>";
    });

    newContent += "</span>";
    priceTag.before(newContent);

    return newPrices;
}

function taxForCurrency(currency) {
    var tax = 1;  // Default value means no tax applied.

    if (currency === "AU" || currency === "A" || currency === "AUD") {
        tax = 1.1;
    }

    return tax;
}

function processItems(currency, refresh = false) {
    var tax = taxForCurrency(currency);

    $(".list-item").each(function () {
        var item = $(this);

        var updatedPriceTag = item.find(".total-price-updated");
        if (updatedPriceTag.length) {
            if (refresh) {
                updatedPriceTag.remove();
            } else {
                // Skip if already updated.
                return;
            }
        }

        var quantity = 1;
        var prices = getPrices(item, ITEM_LIST_PRICE_SELECTOR);
        var shipping = getShipping(item, ITEM_LIST_SHIPPING_SELECTOR);

        var newPrices = addNewPrice(
            item, currency, prices, quantity, shipping, tax,
            ITEM_LIST_PRICE_SELECTOR, ITEM_LIST_SHIPPING_SELECTOR
        );

        // Add prices as attributes.
        var lowerPrice = newPrices[0];
        var upperPrice = lowerPrice;

        if (newPrices.length > 1) {
            upperPrice = newPrices[1];
        }

        item.attr(DATA_LOWER_PRICE, lowerPrice);
        item.attr(DATA_UPPER_PRICE, upperPrice);
    });
}

function sortItems(container, items, attrName) {
    var plainItems = items.toArray();

    items.detach();

    var sorted = plainItems.sort(function (a, b) {
        var aVal = Number(a.getAttribute(attrName)),
            bVal = Number(b.getAttribute(attrName));
        return aVal - bVal;
    });

    sorted.forEach(function (element) {
        container.append(element);
    });
}


/**
 Functions for updating a single product page
 **/
function getQuantity() {
    return Number($(QUANTITY_SELECTOR)[0].value)
}

function updateSingleProductPrice(currency) {
    var productElement = $(".product-info");
    var tax = taxForCurrency(currency);
    var quantity = getQuantity();
    var shipping = getShipping(productElement, PRODUCT_SHIPPING_SELECTOR);
    var prices = getPrices(productElement, PRODUCT_PRICE_SELECTOR);

    var updatedPriceTag = productElement.find(".total-price-updated");
    if (updatedPriceTag.length) {
        updatedPriceTag.remove();
    }

    addNewPrice(
        productElement, currency, prices, quantity, shipping, tax,
        PRODUCT_PRICE_SELECTOR, PRODUCT_SHIPPING_SELECTOR
    );
}


/**
 Userscript will run from here.
 **/
function execute(currency, refresh = false) {
    if ($(".product-main").length) {
        updateSingleProductPrice(currency);
    } else {
        processItems(currency, refresh);

        if (!itemsAlreadySorted) {
            // Sort items using full price.
            var container = $(LIST_SELECTOR);
            var items = container.find('.list-item');

            if (items.length === 60) {
                itemsAlreadySorted = true;
                sortItems(container, items, DATA_LOWER_PRICE);
                showMessage('Items sorted.');
            } else {
                showMessage('Keep scrolling to load all products and sort them');
            }
        }
    }
}

function customObserver(target, config, callback) {
    this.target = target || document;
    this.config = config || {childList: true, subtree: true};
    var that = this;

    this.ob = new MutationObserver(function (mut, obsSelf) {
        callback(that, mut, obsSelf);
    });
}

customObserver.prototype = {
    connect: function () {
        this.ob.observe(this.target, this.config);
    },
    disconnect: function () {
        this.ob.disconnect();
    }
};


var currencyObserver = new MutationObserver(function (mutationRecords, self) {
    if ($(CURRENCY_SELECTOR).length) {
        execute(getCurrency(), true);

        // Stop observing.
        self.disconnect();
        return;
    }
});


var productObserver = new MutationObserver(function (mutationRecords) {
    execute(getCurrency(), false);
});


$(".nav-global").each(function () {
    currencyObserver.observe(this, obsConfig);
});

if ($(".product-main").length) {
    execute(getCurrency(), false);

    $(QUANTITY_SELECTOR).each(function () {
        productObserver.observe(this, obsConfig);
    });

    $(PRODUCT_PRICE_SELECTOR).each(function () {
        productObserver.observe(this, obsConfig);
    });
} else {
    $(LIST_SELECTOR).each(function () {
        var observer = new customObserver(this, obsConfig, function (obs, mutations) {
            obs.disconnect();

            execute(getCurrency(), false);

            obs.connect();
        });

        observer.connect();
    });
}
