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
var obsConfig = {
    childList: true,
    characterData: true,
    attributes: true,
    subtree: true
};


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

        addNewPrice(
            item, currency, prices, quantity, shipping, tax,
            ITEM_LIST_PRICE_SELECTOR, ITEM_LIST_SHIPPING_SELECTOR
        );
    });
}


/**
 Functions for updating a single product page
 **/
function getQuantity() {
    return Number($(QUANTITY_SELECTOR)[0].value)
}

function updateSingleProductPrice(currency) {
    console.warn("Updating price");
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
    }
}


var currencyObserver = new MutationObserver(function (mutationRecords, self) {
    if ($(CURRENCY_SELECTOR).length) {
        execute(getCurrency(), true);

        // Stop observing.
        self.disconnect();
        return;
    }
});
var listItemsObserver = new MutationObserver(function (mutationRecords) {
    execute(getCurrency(), false);
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
        listItemsObserver.observe(this, obsConfig);
    });
}
