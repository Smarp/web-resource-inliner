"use strict";

var path = require( "path" );
var UglifyJS = require( "uglify-js" );
var _ = require( "lodash" );
var xtend = require( "xtend" );
var async = require( "async" );
var inline = require( "./util" );
var css = require( "./css" );

module.exports = function( options, callback )
{
    var settings = xtend( {}, inline.defaults, options );

    function replaceInlineAttribute( string )
    {
        return string
            .replace( new RegExp( " " + settings.inlineAttribute + "-ignore" + inline.attrValueExpression, "gi" ), "" )
            .replace( new RegExp( " " + settings.inlineAttribute + inline.attrValueExpression, "gi" ), "" );
    }

    var replaceScript = function( callback )
    {
        var args = this;

        args.element = replaceInlineAttribute( args.element );

        inline.getTextReplacement( args.src, settings.relativeTo, function( err, content )
        {
            if( err )
            {
                return inline.handleReplaceErr( err, args.src, settings.strict, callback );
            }
            var js = options.uglify ? UglifyJS.minify( content ).code : content;
            if( typeof( args.limit ) === "number" && js.length > args.limit * 1000 )
            {
                return callback( null );
            }
            var html = "<script" + ( args.attrs ? " " + args.attrs : "" ) + ">\n" + js + "\n</script>";
            var re = new RegExp( inline.escapeSpecialChars( args.element ), "g" );
            result = result.replace( re, _.constant( html ) );
            return callback( null );
        } );
    };

    var replaceLink = function( callback )
    {
        var args = this;

        args.element = replaceInlineAttribute( args.element );

        inline.getTextReplacement( args.src, settings.relativeTo, function( err, content )
        {
            if( err )
            {
                return inline.handleReplaceErr( err, args.src, settings.strict, callback );
            }
            if( typeof( args.limit ) === "number" && content.length > args.limit * 1000 )
            {
                return callback( null );
            }

            var cssOptions = xtend( {}, settings, {
                fileContent: content.toString(),
                rebaseRelativeTo: path.relative( settings.relativeTo, path.join( settings.relativeTo, args.src, ".." + path.sep ) )
            } );

            css( cssOptions, function( err, content )
            {
                if( err )
                {
                    return callback( err );
                }
                var html = "<style" + ( args.attrs ? " " + args.attrs : "" ) + ">\n" + content + "\n</style>";
                var re = new RegExp( inline.escapeSpecialChars( args.element ), "g" );
                result = result.replace( re, _.constant( html ) );
                return callback( null );
            } );
        } );
    };

    var replaceImg = function( callback )
    {
        var args = this;

        args.element = replaceInlineAttribute( args.element );

        inline.getFileReplacement( args.src, settings.relativeTo, function( err, datauriContent )
        {
            if( err )
            {
                return inline.handleReplaceErr( err, args.src, settings.strict, callback );
            }
            if( typeof( args.limit ) === "number" && datauriContent.length > args.limit * 1000 )
            {
                return callback( null );
            }
            var html = "<img" + ( args.attrs ? " " + args.attrs : "" ) + " src=\"" + datauriContent + "\" />";
            var re = new RegExp( inline.escapeSpecialChars( args.element ), "g" );
            result = result.replace( re, _.constant( html ) );
            return callback( null );
        } );
    };

    var result = settings.fileContent;
    var tasks = [];
    var found;

    var inlineAttributeRegex = new RegExp( settings.inlineAttribute, "i" );
    var inlineAttributeIgnoreRegex = new RegExp( settings.inlineAttribute + "-ignore", "i" );

    var scriptRegex = /<script\b[\s\S]+?\bsrc\s*=\s*("|')([\s\S]+?)\1[\s\S]*?>\s*<\/script>/gi;
    while( ( found = scriptRegex.exec( result ) ) !== null )
    {
        if( !inlineAttributeIgnoreRegex.test( found[ 0 ] ) &&
            ( settings.scripts || inlineAttributeRegex.test( found[ 0 ] ) ) )
        {
            tasks.push( replaceScript.bind(
            {
                element: found[ 0 ],
                src: _.unescape( found[ 2 ] ).trim(),
                attrs: inline.getAttrs( found[ 0 ], settings ),
                limit: settings.scripts
            } ) );
        }
    }

    var linkRegex = /<link\b[\s\S]+?\bhref\s*=\s*("|')([\s\S]+?)\1[\s\S]*?>/gi;
    while( ( found = linkRegex.exec( result ) ) !== null )
    {
        if( !inlineAttributeIgnoreRegex.test( found[ 0 ] ) &&
            ( settings.links || inlineAttributeRegex.test( found[ 0 ] ) ) )
        {
            tasks.push( replaceLink.bind(
            {
                element: found[ 0 ],
                src: _.unescape( found[ 2 ] ).trim(),
                attrs: inline.getAttrs( found[ 0 ], settings ),
                limit: settings.links
            } ) );
        }
    }

    var imgRegex = /<img\b[\s\S]+?\bsrc\s*=\s*("|')([\s\S]+?)\1[\s\S]*?>/gi;
    while( ( found = imgRegex.exec( result ) ) !== null )
    {
        if( !inlineAttributeIgnoreRegex.test( found[ 0 ] ) &&
            ( settings.images || inlineAttributeRegex.test( found[ 0 ] ) ) )
        {
            tasks.push( replaceImg.bind(
            {
                element: found[ 0 ],
                src: _.unescape( found[ 2 ] ).trim(),
                attrs: inline.getAttrs( found[ 0 ], settings ),
                limit: settings.images
            } ) );
        }
    }

    result = replaceInlineAttribute( result );

    async.parallel( tasks, function( err )
    {
        callback( err, result );
    } );
};
